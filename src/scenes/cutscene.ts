// STUB scene so the app runs end to end. Replaced by the real scene (see HANDOVER.md).
import { drawPrompts } from '../input/prompts';
import type { Game, Scene, SceneParams } from '../types';

export function createCutsceneScene(game: Game, params: SceneParams['cutscene']): Scene {
  return {
    update() {
      if (game.input.pressed('confirm')) { game.state.nextRound(); game.go('fight', { fish: params.fish }); }
    },
    render(ctx) {
      ctx.fillStyle = '#123';
      ctx.fillRect(0, 0, game.width, game.height);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 28px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('CUTSCENE (stub) vs ' + params.fish.name, game.width / 2, game.height / 2);
      drawPrompts(ctx, game.input, [{ action: 'confirm', label: 'CONTINUE' }]);
    },
  };
}
