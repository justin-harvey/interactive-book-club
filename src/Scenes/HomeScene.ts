import { InteriorScene } from './InteriorScene';
import { SceneName } from './enums/SceneNames';

// HOME (brown storefront in town) — the player's cozy Gray, Maine house, and
// home base with an EXIT back to town. Empty for now: Helium (Helior) moved down
// into the Museum basement (in the city).
export default class HomeScene extends InteriorScene {
    constructor() {
        super(SceneName.Home, 'home-interior.png', [], 'room_home');
    }
}
