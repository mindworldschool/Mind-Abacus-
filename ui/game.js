// ui/game.js — Training screen with improved event handling
import { createStepIndicator } from "./helper.js";
import { setResults } from "../core/state.js";
import { eventBus, EVENTS } from "../core/utils/events.js";
import { logger } from "../core/utils/logger.js";
import toast from "./components/Toast.js";

const CONTEXT = 'GameScreen';

export async function renderGame(container, { t, state, navigate }) {
  // Clear container
  container.innerHTML = "";

  // Create screen structure
  const section = document.createElement("section");
  section.className = "screen game-screen";

  // Step indicator (Settings → Confirmation → Game → Results)
  const indicator = createStepIndicator("game", t);
  section.appendChild(indicator);

  // Body (trainer will be mounted here)
  const body = document.createElement("div");
  body.className = "screen__body";
  section.appendChild(body);

  container.appendChild(section);

  // === Subscribe to training finish event ===
  const unsubscribe = eventBus.on(EVENTS.TRAINING_FINISH, (stats) => {
    logger.info(CONTEXT, 'Training finished, navigating to results');
    setResults({
      success: stats.correct || 0,
      total: stats.total || 10
    });
    navigate("results");
  });

  try {
    // Dynamically import trainer
    const module = await import("../ext/trainer_ext.js");

    if (!module?.mountTrainerUI) {
      throw new Error("Module trainer_ext.js loaded but mountTrainerUI not found");
    }

    logger.info(CONTEXT, 'Mounting trainer...');
    const cleanupTrainer = module.mountTrainerUI(body, { t, state });

    // Return cleanup function
    return () => {
      logger.debug(CONTEXT, 'Cleaning up game screen');
      unsubscribe();
      if (typeof cleanupTrainer === 'function') {
        cleanupTrainer();
      }
    };

  } catch (error) {
    logger.error(CONTEXT, 'Failed to load trainer:', error);

    // Secure error display
    const errorDiv = document.createElement("div");
    errorDiv.style.cssText = "color:#d93025; padding:20px; font-weight:600;";

    const message = document.createTextNode("Не удалось загрузить тренажёр.");
    const br = document.createElement("br");
    const small = document.createElement("small");
    small.textContent = error.message;

    errorDiv.append(message, br, small);
    body.appendChild(errorDiv);

    toast.error("Не удалось загрузить тренажёр");

    // Return cleanup
    return () => {
      unsubscribe();
    };
  }
}
