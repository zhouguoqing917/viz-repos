import { ContainerModule } from 'inversify';
import { DEFAULT_HTTP_FALLBACK_OPTIONS, HttpFallbackOptions, WebSocketConnectionProvider } from './ws-connection-provider';

export const messagingFrontendModule = new ContainerModule(bind => {
    bind(HttpFallbackOptions).toConstantValue(DEFAULT_HTTP_FALLBACK_OPTIONS);
    bind(WebSocketConnectionProvider).toSelf().inSingletonScope();
});