import { InteriorScene } from './InteriorScene';
import { SceneName } from './enums/SceneNames';

// The Gray auto-repair garage (brown storefront in town) — placeholder interior
// art for now. Re-scrambled for the official season (2026-10-13): Uranium (Glowbun)
// now lives here; Magnesium moved to Hannaford.
export default class AutoScene extends InteriorScene {
    constructor() {
        super(SceneName.Auto, 'treats-interior.png', ['uranium'], 'room_treats');
    }
}
