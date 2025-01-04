import { BrowserContext } from "@playwright/test";
import { zipWith } from "lodash";
import { Locations, availableSpots } from "../config";
import { resolve } from "path";
import { Observation, Spot } from "../types";

export const getSpotImages = async (context: BrowserContext, spot: Spot): Promise<string> => {
    console.log('Getting image for', spot.name);
    const page = await context.newPage();
    await page.goto(spot.webcam);
    await page.getByLabel('video').first().scrollIntoViewIfNeeded();
    await page.getByLabel('video').first().click();
    await page.getByRole('button', { name: 'Fullscreen' }).click();
    await page.waitForTimeout(2000);
    const timestamp = new Date().toISOString().slice(0, 19);
    const path = resolve(__dirname, '../../images', spot.name, `${timestamp}.jpg`); // TODO: generate dynamic image name
    await page.screenshot({ path });
    await page.close();
    return path;
  };
  
  // TODO: reduce number of tokens 
  export const getForecast = async (context: BrowserContext, location: Locations) => {
    const page = await context.newPage();
    const spot = availableSpots[location];
    await page.goto(spot.forecast);

    await page.locator('#tabid_1_content_div').click(); // to wait until table is loaded
    const data = page.locator('#div_wgfcst1');

    const fetchRowData = async(selector: string) => (await data.locator(selector).allTextContents()).filter(Boolean);

    const dates = await fetchRowData('#tabid_1_0_dates td');
  
    const windSpd = await fetchRowData('#tabid_1_0_WINDSPD td');
    const windGusts = await fetchRowData('#tabid_1_0_GUST td');
    const temperature = await fetchRowData('#tabid_1_0_TMPE td');
    const waves = await fetchRowData('#tabid_1_0_HTSGW td');
  
    const forecast = zipWith(dates, windSpd, windGusts, temperature, waves, (date, speed, gust, temp, wave) => {
      const dateParts = date.match(/(\w+)(\d+).(\w+)/);
      if (!dateParts) {
        return false;
      };
      const hour = parseInt(dateParts[3]);

      if (hour > 21 || hour < 9) {
        return false;
      }

      return {
        date: `${dateParts[1]} ${dateParts[2]} ${dateParts[3]}`,
        speed: `${speed} m/s`,
        isKiteable: parseFloat(speed) >= 7,
        gusts: `${gust} m/s`,
        isGusty: parseFloat(gust) - parseFloat(speed) > 4,
        temperature: `${temp} °C`,
        ...(spot.isOcean ? { 
            waves: `${wave} m`,
            wavesTooHigh: parseFloat(wave) > 2.5
        } : {})
      };
    }).filter(Boolean);
  
    console.log(forecast[0], forecast.length);
    await page.close();
  
    return forecast.slice(0, 20); // TODO: find better way
  }

  export async function analyzeImage(spot: Spot, path: string): Promise<Observation> {
    try {
      const response = await fetch(`http://127.0.0.1:8000/?imagePath=${path}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      data.spot = spot.name;
      return data;
    } catch (error) {
      console.error('Error analyzing image:', error);
      throw error;
    }
  }