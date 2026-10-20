// https://blog.ourcade.co/posts/2020/phaser3-how-to-communicate-between-scenes/
import 'phaser';   // this module subclasses Phaser at load; make the dependency
                   // explicit so the bundler always evaluates Phaser (which sets the
                   // global) FIRST, no matter who imports GlobalInfo (otherwise the
                   // top-level `new GlobalInfo()` can run before Phaser is defined).

class GlobalInfo extends Phaser.Events.EventEmitter {
    _gameProgress: {
        [index: string]: any
    }

    constructor() {
        super()

        // initial state from global info
        this._gameProgress = {
            // habilities to unblock
            canBark: false,
            canSniff: false,
            coins: 0,
            health: 100,
            // true while a quiz/dialogue modal is open — freezes player movement
            inDialogue: false
            // here all info you want global
        }


        Object.keys(this._gameProgress).forEach(key => {
            this.on(key, (args: boolean) => {
                this._gameProgress[key] = args
            })
        })

    }
}

export default new GlobalInfo()