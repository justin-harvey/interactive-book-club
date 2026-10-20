import { NpcsAndObjects } from './NpcAndObjects';
import { SceneName } from '../enums/SceneNames';
import GameScene from "../GameScene";
import { ObjectType } from '../enums/ObjectType';

interface DoorProps {
    scene: GameScene,
    xPosition: number,
    yPosition: number,
    nextScene: SceneName,
    // The walkable tile just outside the door, relative to the door tile.
    // Stepping onto it enters the room. Defaults to the tile below the door
    // (town storefronts: player approaches from the south). Interiors pass
    // { dx: 0, dy: -1 } because their exit door sits at the bottom wall.
    entryOffset?: { dx: number, dy: number }
}

export class Door extends NpcsAndObjects {

    protected action: Function;

    constructor({
        scene,
        xPosition,
        yPosition,
        nextScene,
        entryOffset
    }: DoorProps) {
        super(scene, ObjectType.Door, xPosition, yPosition, 'emptyDoorGraphic', 1, undefined)

        const enter = (): void => {
            if (this.scene.characterMoved) {
                this.scene.characterMoved = false
                this.scene.switch(nextScene)
            }
        }

        // Keyboard: face the door (arrow held) and it opens — legacy behaviour.
        this.action = enter

        // Click / step to enter: the door tile itself is blocked by this Door
        // character, so the entrance is the walkable square right outside it.
        // When the player finishes a move onto that pad, enter the room. This is
        // the only way click-to-move players can get in — they never hold an
        // arrow key, which the facing-based interaction requires.
        const off = entryOffset ?? { dx: 0, dy: 1 }
        const pad = { x: xPosition + off.dx, y: yPosition + off.dy }
        // movementStopped fires once when the whole path ends (not per tile), so
        // walking *through* the pad on the way somewhere else won't enter — only
        // coming to rest on it does.
        const sub = scene.gridEngine.movementStopped().subscribe(({ charId }) => {
            if (charId !== scene.playerName) return
            const pos = scene.gridEngine.getPosition(scene.playerName)
            if (pos.x === pad.x && pos.y === pad.y) {
                enter()
            }
        })
        // Drop the subscription when the scene shuts down so it doesn't leak.
        scene.events.once('shutdown', () => sub.unsubscribe())
    }
}
