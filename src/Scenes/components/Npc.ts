import { Direction, WalkingAnimationMapping } from 'grid-engine';
import GameScene from '../GameScene';
import { NpcsAndObjects } from './NpcAndObjects';
import { ObjectType } from '../enums/ObjectType';

interface NPCProps {
    scene: GameScene,
    xPosition: integer,
    yPosition: integer,
    texture: string,
    scale: number,
    action?: Function,
    walkingAnimationMapping?: number | WalkingAnimationMapping,
    facingDirection?: Direction;
    tint?: number;
}

export class Npc extends NpcsAndObjects {

    facingDirection?: Direction;

    constructor({
        scene,
        xPosition,
        yPosition,
        texture,
        scale = 1,
        action,
        walkingAnimationMapping,
        facingDirection,
        tint
    }: NPCProps
    ) {
        super(scene, ObjectType.NPC, xPosition, yPosition, texture, scale, action, walkingAnimationMapping, tint)
        this.facingDirection = facingDirection
    }

    //add character to GridEngine
    addCharacter(
        npcSprite: Phaser.Physics.Arcade.Sprite,
        xPosition: integer,
        yPosition: integer,
        container: Phaser.GameObjects.Container,
        walkingAnimationMapping?: number | WalkingAnimationMapping
    ): void {
        // A single-frame image (e.g. an Elemental's real art PNG) has no walk
        // frames, so grid-engine must be left without a mapping — passing one
        // makes it index frames that don't exist. Only include it when set.
        const config: any = {
            id: (this.name),
            sprite: npcSprite,
            container,
            startPosition: { x: xPosition, y: yPosition },
            facingDirection: this.facingDirection || Direction.DOWN
        }
        if (walkingAnimationMapping !== undefined) {
            config.walkingAnimationMapping = walkingAnimationMapping
        }
        this.scene.gridEngine.addCharacter(config)
    }
}