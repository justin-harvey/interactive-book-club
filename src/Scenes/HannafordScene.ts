import { InteriorScene } from './InteriorScene';
import { SceneName } from './enums/SceneNames';

// Hannaford's grocery (red storefront in town) — placeholder cafe interior art
// for now. Re-scrambled for the official season (2026-10-13): Magnesium (Magflash)
// now lives here; Sodium moved to the Hardware store.
export default class HannafordScene extends InteriorScene {
    constructor() {
        super(SceneName.Hannaford, 'cafe-interior.png', ['magnesium'], 'room_cafe');
    }
}
