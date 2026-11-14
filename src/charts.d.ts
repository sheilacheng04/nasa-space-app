export function chart(rows: { date: string; [key: string]: unknown }[], options: {key: string; label: string; unit: string; color?: string; bars?: boolean; annotation?: string}): string;

export function weatherChart(rows: import('./weather-data').WeatherComparison[], options:{label:string;unit:string;color?:string;bars?:boolean;domain:[number,number];annotation?:string}):string;
