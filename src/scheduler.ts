import { MongoClient } from "mongodb";
import { getTimes } from 'suncalc';
import { analyzeImage, getSpotImages } from "./lib/tools";
import { BrowserContext } from "@playwright/test";
import { Observation, Spot } from "./types";
import { DateTime } from 'luxon';

export async function registerScheduler(context: BrowserContext, client: MongoClient) {
    setInterval(async() => {
        const now = new Date();
        const times = getTimes(now, 38.7131707, -9.4054484); // Cascais
        const isDay = times.sunrise < now && now < times.sunset;
        if (!isDay) {
            return;
        }

        const spots = await client.db().collection<Spot>('spots').find({}).toArray();
        for (const spot of spots) {
            if (now > spot.nextCheck) {
                console.log(`Performing spot check for ${spot.name}`);
                const imagePath = await getSpotImages(context, spot);
                const result = await analyzeImage(imagePath);
                const hasKiters = result.matches.some(el => el.label === 'kite');

                const lastKiterSeenMinutes = DateTime.fromJSDate(spot.lastKiterSeen).diffNow().as('minutes');

                await client.db().collection<Observation>('observations').insertOne({ ...result, spot: spot.name, createdAt: now });

                await client.db().collection<Spot>('spots').updateOne({ _id: spot._id}, {$set: { 
                    hasKiters,
                    lastKiterSeen: hasKiters ? now : spot.lastKiterSeen,
                    nextCheck: DateTime.now().plus({ minutes: hasKiters && lastKiterSeenMinutes < 30 ? 5 : 30 }).toJSDate() 
                }})
                break;
            } else {
                console.log(`Skipping spot check for ${spot.name}`);
            }
        }
    }, 30000); //TODO: use scheduling instead of polling
}