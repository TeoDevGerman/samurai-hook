// STUB scene so the app runs end to end. Replaced by the real scene (see HANDOVER.md).
import { drawPrompts } from '../input/prompts';
import type { Game, Scene, SceneParams } from '../types';

export function createOceanScene(game: Game, _params: SceneParams['ocean']): Scene {
  return {
    update() {
      if (game.input.pressed('confirm')) game.go('cutscene', { fish: game.state.pickFish(10)! });
      if (game.input.pressed('shop')) game.go('shop', undefined);
    },
    render(ctx) {
      ctx.fillStyle = '#123';
      ctx.fillRect(0, 0, game.width, game.height);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 28px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('OCEAN (stub)  gold ' + game.state.gold, game.width / 2, game.height / 2);
      drawPrompts(ctx, game.input, [{ action: 'confirm', label: 'CONTINUE' }]);
    },
  };
}
