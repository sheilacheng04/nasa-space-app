export const BACKGROUND_KEY: string;
export function createBackground(canvas: HTMLCanvasElement): {setScene(scene: string): void; pause(paused: boolean): void; destroy(): void};
