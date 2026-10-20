import { ObjectType } from '../enums/ObjectType';
import 'phaser'
import GameScene from "../GameScene"
import GlobalInfo from '../../GlobalInfo'
import { WalkingAnimationMapping, Direction } from 'grid-engine'

export class NpcsAndObjects {
    static number: integer = 0;
    static npcsAndObjectsArray: NpcsAndObjects[] = [];
    texture?: string;
    name: string
    type: ObjectType;
    scene: GameScene;
    startX: integer = 0;
    startY: integer = 0;
    speed: integer = 4;
    container!: Phaser.GameObjects.Container;
    interactionCounter: integer = 0;
    facingDirection?: Direction;
    // When true, this object fires its action as soon as the player comes to
    // rest within one tile of it — no key press (mobile-first, see interaction()).
    // Elementals set this; doors handle their own step-on logic in Door.ts.
    proximityTrigger: boolean = false;
    // Re-arms only once the player has stepped back out of range, so closing a
    // quiz while still standing next to the Elemental won't instantly reopen it.
    armed: boolean = true;

    protected action: Function = (): void => {
        // code here for default action
    }

    constructor(
        scene: GameScene,
        type: ObjectType,
        xPos: integer,
        yPos: integer,
        texture: string | undefined,
        scale: number,
        action?: Function,
        walkingAnimationMapping?: number | WalkingAnimationMapping,
        tint?: number
    ) {
        this.name = `${type}${NpcsAndObjects.number}`
        NpcsAndObjects.number++
        NpcsAndObjects.npcsAndObjectsArray.push(this)
        this.type = type
        this.scene = scene

        this.startX = xPos
        this.startY = yPos
        this.texture = texture

        // add object to the scene
        const npcSprite = createCharacterSprite(scene, 0, 0, texture, scale)
        // placeholder monster colouring — real sprite sheets replace this later
        if (tint !== undefined) npcSprite.setTint(tint)
        this.addCharacter(npcSprite, xPos, yPos, this.container, walkingAnimationMapping)

        // add action to execute when player interacts with the object
        if (action) {
            this.action = action
        }

        scene.npcsAndObjectsArray.push(this)
    }

    // Proximity-based interaction (mobile-first — no interact key). When the
    // player comes to rest within one tile of a proximity-triggering object
    // (an Elemental), its action fires automatically. This is the touch
    // equivalent of walking into a wild Pokémon; it works for both tap-to-move
    // and arrow keys since it only listens for the player's movement stopping.
    static interaction(
        scene: GameScene
    ): void {
        // prevents doors from being used repeatedly after switching the scene/room
        scene.events.addListener('wake', () => {
            scene.characterMoved = false
        })

        const stopSub = scene.gridEngine.movementStopped().subscribe((observer) => {
            if (observer.charId !== scene.playerName) return
            scene.gridEngine.setSpeed(scene.playerName, 4)
            this.checkProximity(scene)
        })

        // A quiz closing also resets speed and re-checks (in case the player is
        // still adjacent after stepping away and back).
        const onDialogue = (): void => { this.checkProximity(scene) }
        GlobalInfo.on('inDialogue', onDialogue)

        // Tidy up on scene shutdown so subscriptions/listeners don't pile up
        // (GlobalInfo is a shared singleton across all scenes).
        scene.events.once('shutdown', () => {
            stopSub.unsubscribe()
            GlobalInfo.off('inDialogue', onDialogue)
        })
    }

    // Fire the action of any armed proximity object within one tile of the
    // player. Objects re-arm only once the player moves back out of range.
    private static checkProximity(
        scene: GameScene
    ): void {
        // The inDialogue listener is global, so ignore scenes that are asleep.
        if (!scene.sys.isActive()) return
        const player = scene.gridEngine.getPosition(scene.playerName)

        scene.npcsAndObjectsArray.forEach(object => {
            if (!object.proximityTrigger) return
            // Skip anything not (yet) registered in grid-engine: getPosition throws
            // on an unknown id, and an uncaught throw here would abort the whole
            // forEach — silently killing proximity for every object after it in the
            // array (e.g. a treasure chest spawned after the Elementals).
            if (!scene.gridEngine.hasCharacter(object.name)) return

            const pos = scene.gridEngine.getPosition(object.name)
            // Chebyshev distance: the 8 tiles around the player count as "one
            // tile away" so a diagonal stop (from CLOSEST_REACHABLE) still fires.
            const dist = Math.max(Math.abs(pos.x - player.x), Math.abs(pos.y - player.y))

            if (dist <= 1) {
                if (object.armed && !GlobalInfo._gameProgress.inDialogue) {
                    object.armed = false
                    // Turn the dog to face the Elemental it walked up to.
                    scene.gridEngine.turnTowards(scene.playerName, directionTo(player, pos))
                    object.action(scene, object.name)
                }
            } else {
                object.armed = true
            }
        })
    }

    // add a character to the GridEngine
    addCharacter(
        npcSprite: Phaser.Physics.Arcade.Sprite,
        xPos: integer,
        yPos: integer,
        container: Phaser.GameObjects.Container,
        walkingAnimationMapping?: number | WalkingAnimationMapping
    ): void {
        this.scene.gridEngine.addCharacter(
            {
                id: (this.name),
                sprite: npcSprite,
                container,
                startPosition: { x: xPos, y: yPos },
                facingDirection: this.facingDirection ?? Direction.DOWN,
                speed: this.speed,
                walkingAnimationMapping: walkingAnimationMapping ?? 0
            }
        )
    }
}


// Direction from tile `from` toward tile `to`, picking the dominant axis.
function directionTo(
    from: { x: number, y: number },
    to: { x: number, y: number }
): Direction {
    const dx = to.x - from.x
    const dy = to.y - from.y
    if (Math.abs(dx) >= Math.abs(dy)) {
        return dx >= 0 ? Direction.RIGHT : Direction.LEFT
    }
    return dy >= 0 ? Direction.DOWN : Direction.UP
}

// create a character at the given coordinates on the map and scale it
export function createCharacterSprite(
    scene: GameScene,
    x: number,
    y: number,
    texture: string,
    scale: number
): Phaser.Physics.Arcade.Sprite {
    const sprite: Phaser.Physics.Arcade.Sprite = scene.physics.add.sprite(x, y, texture)
    sprite.scale = scale
    // Above the building overlay images (depth 1) so the player and NPCs walk in
    // front of the storefronts instead of being hidden behind them.
    sprite.setDepth(10)

    return sprite
}