import GameScene from '../GameScene'
import { Direction, NoPathFoundStrategy } from 'grid-engine'
import globalGameState from '../../GlobalInfo'

// Click / tap to move: grid-engine pathfinds the player to the tile the player
// clicked. Keyboard movement (basicMovement) still works alongside this.
export function clickToMove(
    scene: GameScene
): void {
    scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        // Only respond to the primary (left) button, and never while a dialogue
        // or quiz is open.
        if (!pointer.leftButtonDown() || globalGameState._gameProgress.inDialogue) {
            return
        }

        // Ignore taps that landed on a DOM UI element over the canvas (the DEX /
        // Leave / HUD buttons) so a near-miss doesn't send the dog wandering off.
        const target = pointer.event?.target as Element | undefined
        if (target && target !== scene.game.canvas) {
            return
        }

        // pointer.worldX/Y already account for camera scroll + zoom.
        const targetTile = {
            x: scene.map.worldToTileX(pointer.worldX),
            y: scene.map.worldToTileY(pointer.worldY),
        }

        // Visual confirmation that the tap registered (important on touch — kids
        // otherwise can't tell if a tap "took"). A ring blooms and fades where
        // they tapped.
        showTapRipple(scene, pointer.worldX, pointer.worldY)

        // If the clicked tile is blocked (e.g. an Elemental stands on it), walk
        // to the nearest reachable tile instead so the player ends up adjacent.
        // Walking within one tile of an Elemental opens its quiz (no key press).
        scene.gridEngine.moveTo(scene.playerName, targetTile, {
            noPathFoundStrategy: NoPathFoundStrategy.CLOSEST_REACHABLE,
        })
    })
}

// A small ring that blooms outward and fades at the tapped point.
function showTapRipple(
    scene: GameScene,
    worldX: number,
    worldY: number
): void {
    const ring = scene.add.circle(worldX, worldY, 7)
    ring.setStrokeStyle(2, 0xffd166, 0.9)
    ring.setFillStyle(0xffd166, 0.15)
    ring.setDepth(50)            // above the map/buildings, below the HUD
    scene.tweens.add({
        targets: ring,
        scale: { from: 0.4, to: 1.7 },
        alpha: { from: 0.9, to: 0 },
        duration: 420,
        ease: 'Cubic.easeOut',
        onComplete: () => ring.destroy(),
    })
}

// create movements for NPCs
export function basicMovement(
    scene: GameScene
): void {
    const movementStartListener = scene.gridEngine.positionChangeStarted()
    const movementStopListener = scene.gridEngine.positionChangeFinished()

    const movementListener = new MovementListener(scene)

    movementStartListener.subscribe((observer) => {
        if (observer.charId === scene.playerName) {
            movementListener.off()
        } else if (observer.charId.toLowerCase().includes('object')) {
            // objects can't move on it's own, so this will make the character follow a box when pushing it for example
            manualMovement(scene)
        }
    })

    movementStopListener.subscribe((observer) => {
        scene.characterMoved = true
        if (observer.charId === scene.playerName) {
            manualMovement(scene)
            movementListener.on()
        }
    })

    globalGameState.on('inDialogue', (value: boolean) => {
        if (value) {
            movementListener.off()
        } else {
            movementListener.on()
        }
    })
}

// check if a cursor key is down without events 
function manualMovement(
    scene: GameScene
): void {
    if (scene.cursors.up.isDown) {
        scene.gridEngine.move(scene.playerName, Direction.UP)
    } else if (scene.cursors.left.isDown) {
        scene.gridEngine.move(scene.playerName, Direction.LEFT)
    } else if (scene.cursors.down.isDown) {
        scene.gridEngine.move(scene.playerName, Direction.DOWN)
    } else if (scene.cursors.right.isDown) {
        scene.gridEngine.move(scene.playerName, Direction.RIGHT)
    }
}

// manage the movement Listeners of a scene.
class MovementListener {
    scene!: GameScene

    constructor(
        scene: GameScene
    ) {
        this.scene = scene
        if (!globalGameState._gameProgress.inDialogue) {
            this.on()
        }
    }

    // Enables listeners for directions.
    on(): void {
        this.correctPosition()
        this.scene.cursors.up.on('down', () => {
            this.scene.gridEngine.move(this.scene.playerName, Direction.UP)
        })
        this.scene.cursors.left.on('down', () => {
            this.scene.gridEngine.move(this.scene.playerName, Direction.LEFT)
        })
        this.scene.cursors.down.on('down', () => {
            this.scene.gridEngine.move(this.scene.playerName, Direction.DOWN)
        })
        this.scene.cursors.right.on('down', () => {
            this.scene.gridEngine.move(this.scene.playerName, Direction.RIGHT)
        })
    }

    // Diables all listeners. 
    off(): void {
        this.scene.cursors.up.off('down')
        this.scene.cursors.left.off('down')
        this.scene.cursors.down.off('down')
        this.scene.cursors.right.off('down')
    }

    private correctPosition(): void {
        if (
            !this.scene.gridEngine.isMoving(this.scene.playerName) &&
            (this.scene.gridEngine.getPosition(this.scene.playerName).y !== Math.floor(((this.scene.gridEngine.getSprite(this.scene.playerName).getBottomCenter().y - 1.5) / this.scene.map.tileHeight)) ||
                this.scene.gridEngine.getPosition(this.scene.playerName).x !== Math.floor(((this.scene.gridEngine.getSprite(this.scene.playerName).getBottomCenter().x) / this.scene.map.tileWidth)))
        ) {
            this.scene.gridEngine.setPosition(this.scene.playerName, this.scene.gridEngine.getPosition(this.scene.playerName))
        }
    }
}