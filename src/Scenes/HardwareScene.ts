import { InteriorScene } from './InteriorScene';
import { SceneName } from './enums/SceneNames';

// The Gray Hardware Store (red storefront in town) — placeholder interior art
// for now. Re-scrambled for the official season (2026-10-13): Sodium (Sodizap)
// now lives here; Iron moved to the Library.
export default class HardwareScene extends InteriorScene {
    constructor() {
        super(SceneName.Hardware, 'treats-interior.png', ['sodium'], 'room_treats');
    }
}
