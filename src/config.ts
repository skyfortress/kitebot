export const availableSpots = {
    'Guincho': {
        webcam: 'https://beachcam.meo.pt/livecams/praia-do-guincho/',
        forecast: 'https://www.windguru.cz/31',
        isOcean: true,
    },
    'Albufeira': {
        webcam: 'https://beachcam.meo.pt/livecams/lagoa-de-albufeira/',
        forecast: 'https://www.windguru.cz/185',
        isOcean: false,
    },
    'Fonta': {
        webcam: 'https://beachcam.meo.pt/livecams/fonte-da-telha/',
        forecast: 'https://www.windguru.cz/298835',
        isOcean: true,
    },
    'Obidos': {
        webcam: 'https://beachcam.meo.pt/livecams/foz-do-arelho/',
        forecast: 'https://www.windguru.cz/177',
        isOcean: false,
    }
} as const ;

export type Locations = keyof typeof availableSpots;