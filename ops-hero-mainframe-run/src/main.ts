import Phaser from 'phaser';

import { createGameConfig } from './config/GameConfig';
import { ScaffoldScene } from './scenes/ScaffoldScene';

// Scene list is deliberately minimal: the real Boot/Preload/MainMenu/Level/Hud/GameOver scenes
// are specified in SPEC.md section 5.2 but not implemented yet.
const game = new Phaser.Game(createGameConfig([ScaffoldScene]));

document.getElementById('boot-fallback')?.remove();

export default game;
