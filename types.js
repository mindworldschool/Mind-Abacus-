/**
 * @fileoverview JSDoc type definitions for the Abacus Mental Trainer application
 * These types provide IDE autocomplete and type checking without TypeScript
 */

/**
 * @typedef {Object} AppSettings
 * @property {string} mode - Training mode: "mental" or "abacus"
 * @property {string} digits - Number of digits: "1" to "9"
 * @property {boolean} combineLevels - Whether to combine difficulty levels
 * @property {ActionSettings} actions - Actions configuration
 * @property {ExampleSettings} examples - Examples configuration
 * @property {string} timeLimit - Time limit setting
 * @property {string} speed - Display speed setting
 * @property {ToggleSettings} toggles - Advanced toggles
 * @property {BlocksSettings} blocks - Training blocks configuration
 * @property {string} transition - Transition animation type
 * @property {boolean} inline - Display mode: inline or column
 * @property {boolean} [timeLimitEnabled] - Whether time limit is enabled
 * @property {number} [timePerExampleMs] - Time per example in milliseconds
 * @property {boolean} [showSpeedEnabled] - Whether speed display is enabled
 * @property {number} [showSpeedMs] - Display speed in milliseconds
 * @property {number} [showSpeedPauseAfterChainMs] - Pause after chain in ms
 * @property {number} [bigDigitScale] - Scale for big digit display
 * @property {boolean} [lockInputDuringShow] - Lock input during display
 * @property {boolean} [beepOnStep] - Beep sound on each step
 * @property {boolean} [beepOnTimeout] - Beep sound on timeout
 */

/**
 * @typedef {Object} ActionSettings
 * @property {number} count - Number of actions
 * @property {boolean} infinite - Whether infinite actions
 */

/**
 * @typedef {Object} ExampleSettings
 * @property {number} count - Number of examples
 * @property {boolean} infinite - Whether infinite examples
 */

/**
 * @typedef {Object} ToggleSettings
 * @property {boolean} hard - Hard mode toggle
 * @property {boolean} dictation - Dictation mode toggle
 * @property {boolean} fractions - Fractions toggle
 * @property {boolean} mirror - Mirror mode toggle
 * @property {boolean} round - Rounding toggle
 * @property {boolean} positive - Positive numbers only
 * @property {boolean} negative - Negative numbers only
 * @property {boolean} opposite - Opposite operations
 */

/**
 * @typedef {Object} BlockSettings
 * @property {string[]} digits - Selected digits for this block
 * @property {boolean} onlyAddition - Addition only mode
 * @property {boolean} onlySubtraction - Subtraction only mode
 */

/**
 * @typedef {Object} BlocksSettings
 * @property {BlockSettings} simple - Simple operations block
 * @property {BlockSettings} brothers - Brothers technique block
 * @property {BlockSettings} friends - Friends technique block
 * @property {BlockSettings} mix - Mixed operations block
 */

/**
 * @typedef {Object} TrainingResults
 * @property {number} success - Number of correct answers
 * @property {number} total - Total number of examples
 */

/**
 * @typedef {Object} AppState
 * @property {string} route - Current route/screen
 * @property {string} language - Current language code
 * @property {AppSettings} settings - Application settings
 * @property {TrainingResults} results - Training results
 */

/**
 * @typedef {Object} Example
 * @property {Array<string|number>} steps - Steps in the example
 * @property {number} answer - Correct answer
 */

/**
 * @typedef {Object} TrainingSession
 * @property {Example|null} currentExample - Current example being solved
 * @property {SessionStats} stats - Session statistics
 * @property {number} completed - Number of completed examples
 */

/**
 * @typedef {Object} SessionStats
 * @property {number} correct - Number of correct answers
 * @property {number} incorrect - Number of incorrect answers
 * @property {number} total - Total number of examples
 */

/**
 * @typedef {Object} TranslationFunction
 * @property {function(string, string=): string} t - Translation function
 */

/**
 * @typedef {Object} RenderContext
 * @property {function(string, string=): string} t - Translation function
 * @property {AppState} state - Application state
 * @property {function(string): void} navigate - Navigation function
 * @property {function(Partial<AppSettings>): void} updateSettings - Update settings function
 */

/**
 * @typedef {Object} ToastOptions
 * @property {'info'|'success'|'warning'|'error'} [type] - Toast type
 * @property {number} [duration] - Display duration in milliseconds
 * @property {function(): void} [onClose] - Callback when toast is closed
 */

/**
 * @typedef {Object} EventListener
 * @property {HTMLElement} element - DOM element
 * @property {string} event - Event name
 * @property {Function} handler - Event handler function
 */

/**
 * @typedef {Object} LogLevel
 * @property {number} DEBUG - Debug level (0)
 * @property {number} INFO - Info level (1)
 * @property {number} WARN - Warning level (2)
 * @property {number} ERROR - Error level (3)
 * @property {number} NONE - No logging (4)
 */

/**
 * @typedef {Object} TimerOptions
 * @property {function(number): void} [onTick] - Called on each tick with remaining ms
 * @property {function(): void} [onExpire] - Called when timer expires
 * @property {string} [textElementId] - ID of element to display time
 * @property {string} [barSelector] - Selector for progress bar element
 */

/**
 * @typedef {Object} SoundOptions
 * @property {number} [volume] - Volume level (0-1)
 * @property {number} [playbackRate] - Playback rate (0.5-2)
 */

/**
 * @typedef {Object} StateChangeEvent
 * @property {AppState} previous - Previous state
 * @property {AppState} current - Current state
 * @property {Partial<AppState>} changes - Changes applied
 */

/**
 * @typedef {Object} LanguageInfo
 * @property {string} code - Language code (e.g., "en", "ua")
 * @property {string} label - Display label for language
 */

/**
 * @callback UnsubscribeFunction
 * @returns {void}
 */

/**
 * @callback CleanupFunction
 * @returns {void}
 */

/**
 * @callback NavigateFunction
 * @param {string} route - Route name to navigate to
 * @returns {void}
 */

/**
 * @callback RenderFunction
 * @param {HTMLElement} container - Container element
 * @param {RenderContext} context - Render context
 * @returns {CleanupFunction|void} Optional cleanup function
 */

// Export types (for IDE, no runtime effect)
export {};
