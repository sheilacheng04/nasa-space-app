export const HOSTED = !globalThis.__PACIFIC_DEMO__;
export const DATA_ROOT = './data/';
export const REQUEST_TIMEOUT = 12000;
export const REVIEW_DATE = '2026-11-14';
export const POLARIZATIONS = {
 VH: 'Vertical out, horizontal back. A cross-polarized channel often available from Sentinel-1. Sensitive to scattering within vegetation; it is not interchangeable with NISAR HV.',
 HH: 'Horizontal out, horizontal back. Sensitive to surface structure and moisture. Flooded vegetation can brighten through double-bounce scattering.',
 HV: 'Horizontal out, vertical back. Scattering within crops and forest can reveal structure. Changes are not a direct measure of plant health.',
 VV: 'Vertical out, vertical back. Often available from Sentinel-1. Smooth open water can appear dark; wind and viewing geometry can change the signal.',
 composite: 'False-color view: red = HH, green = HV, blue = HH/HV power ratio. Only available when both measured channels exist; these are not natural colors.'
};
