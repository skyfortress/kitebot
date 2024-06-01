import { BrowserContext } from "@playwright/test";
import { zipWith } from "lodash";
import { Locations, availableSpots } from "../config";

export const getSpotImages = async (context: BrowserContext, location: Locations): Promise<Buffer[]> => {
    console.log('Getting image for', location);
    const page = await context.newPage();
    await page.goto(availableSpots[location].webcam);
  
    await page.getByLabel('video').first().scrollIntoViewIfNeeded();
    await page.getByLabel('video').first().click();
    await page.getByRole('button', { name: 'Fullscreen' }).click();
    await page.waitForTimeout(2000);
    const image1 = await page.screenshot();
    console.log('Image 1 is ready');
    await page.waitForTimeout(15000);
    const image2 = await page.screenshot();
    console.log('Image 2 is ready');
    await page.waitForTimeout(15000);
    const image3 = await page.screenshot();
    console.log('Image 3 is ready');
    await page.close();
  
    return [image1, image2, image3];
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