import Phaser from 'phaser';

import { createGameConfig } from './config/GameConfig';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { LevelScene } from './scenes/LevelScene';
import { HudScene } from './scenes/HudScene';
import { GameOverScene } from './scenes/GameOverScene';

// Flow: Boot -> Preload -> MainMenu -> (Level || Hud) -> GameOver -> MainMenu. See SPEC.md 5.2.
const game = new Phaser.Game(
  createGameConfig([BootScene, PreloadScene, MainMenuScene, LevelScene, HudScene, GameOverScene]),
);

document.getElementById('boot-fallback')?.remove();

export default game;
