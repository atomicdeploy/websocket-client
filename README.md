# WebSocket Client

A general-purpose WebSocket client with extensible commands and events functionality.

## Features

- **WebSocket Connection Management**: Connect, disconnect, auto-reconnect with configurable delays
- **Real-time Logging**: Comprehensive logging with filtering (info/warn/error), export, and download capabilities
- **Action System**: Extensible action registry for custom commands
- **Theme Support**: Dark mode with theme toggle
- **Local Storage**: Persistent settings and connection history
- **Reusable Effects**: Countdown animation component for custom actions

## Usage

Simply open `index.html` in a modern web browser. No build step or dependencies required.

### Connecting to a WebSocket Server

1. Enter your WebSocket URL (e.g., `ws://localhost:8080/ws` or `wss://example.com/socket`)
2. Click **Connect**
3. Use the action buttons to send messages or interact with your server

## Extensibility

The app exposes a public API for customization:

```javascript
// Access the public API
const { Actions, Log, Storage, Countdown, App } = window.WebSocketClientApp;

// Define custom actions
Actions.define('custom:led-on', (ctx) => {
  ctx.log.info('Turning LED on');
  ctx.ws.send('led:on');
});

Actions.define('custom:countdown-demo', async (ctx) => {
  await Countdown.show(document.querySelector('#countdown'), () => {
    ctx.log.info('Countdown complete!');
    ctx.ws.send('start:process');
  });
});

// Add custom action buttons in HTML
// <button class="action" data-action="custom:led-on">
//   <svg class="icon"><use href="#i-power"></use></svg>
//   <span>LED On</span>
// </button>
```

### Public API

- **Actions**: Define and run custom actions
  - `Actions.define(name, handler)` - Register a new action
  - `Actions.run(name, ctx, element)` - Execute an action
- **Log**: Logging utilities
  - `Log.info(msg)`, `Log.warn(msg)`, `Log.error(msg)`
  - `Log.rx(msg)`, `Log.tx(msg)` - Log received/transmitted messages
  - `Log.clear()`, `Log.copyAll()`, `Log.download()`
- **Storage**: LocalStorage wrapper
  - `Storage.get(key, fallback)`, `Storage.set(key, value)`, `Storage.del(key)`
- **Countdown**: Reusable countdown effect
  - `Countdown.show(element, onComplete)` - Display countdown animation
- **App**: Core application state and methods
  - `App.connect()`, `App.disconnect()`
  - `App.state` - Current application state
  - `App.ws` - WebSocket client instance

### Message Format

The client expects messages in `key:value` format (no spaces). Built-in handlers:

- `log:message` - Logged as info
- `warn:message` - Logged as warning
- `error:message` - Logged as error

All other formats are logged as raw messages.

## Architecture

- **Pure Vanilla JS**: No frameworks or build tools required
- **Single File App**: All logic in `app.js`, styles inline in `index.html`
- **Modular Design**: Clear separation of concerns (WSClient, Actions, Log, UI, Storage)
- **Event-Driven**: Actions system for extensibility

## Customization

To add your own functionality:

1. Define custom actions using `Actions.define()`
2. Add corresponding buttons in the HTML with `data-action` attributes
3. Handle custom message formats in `App.handleWSMessage()`
4. Use the countdown effect for timed actions
5. Persist custom settings using `Storage`

## Browser Support

Works in all modern browsers that support:
- WebSocket API
- ES6+ JavaScript
- CSS Grid and Flexbox
- LocalStorage

## License

See repository for license information.
