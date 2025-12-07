import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AgeWallet } from '../src/AgeWallet.js';

// --- Mocks ---
// We mock the internal modules to isolate the AgeWallet class logic
vi.mock('../src/modules/Security.js', () => ({
    Security: vi.fn().mockImplementation(() => ({
        generateRandomString: vi.fn(() => 'mock_random_string'),
        generatePkceVerifier: vi.fn(() => 'mock_verifier'),
        generatePkceChallenge: vi.fn().mockResolvedValue('mock_challenge')
    }))
}));

vi.mock('../src/modules/Storage.js', () => ({
    Storage: vi.fn().mockImplementation(() => ({
        setOidcState: vi.fn(),
        getOidcState: vi.fn(),
        setVerification: vi.fn(),
        getVerificationToken: vi.fn(),
        clearVerification: vi.fn()
    }))
}));

vi.mock('../src/modules/Network.js', () => ({
    Network: vi.fn().mockImplementation(() => ({
        postForm: vi.fn(),
        get: vi.fn()
    }))
}));

vi.mock('../src/modules/Renderer.js', () => ({
    Renderer: vi.fn().mockImplementation(() => ({
        renderLoading: vi.fn(),
        clearGate: vi.fn(),
        revealPage: vi.fn()
    }))
}));

// Mock Strategies to verify if they are instantiated/executed
const mockOverlayExecute = vi.fn();
const mockApiExecute = vi.fn();

vi.mock('../src/strategies/OverlayStrategy.js', () => ({
    OverlayStrategy: vi.fn().mockImplementation(() => ({
        execute: mockOverlayExecute
    }))
}));

vi.mock('../src/strategies/ApiStrategy.js', () => ({
    ApiStrategy: vi.fn().mockImplementation(() => ({
        execute: mockApiExecute
    }))
}));

// --- Test Suite ---
describe('AgeWallet Core SDK', () => {
    let aw;
    let mockStorage;
    let mockNetwork;

    beforeEach(() => {
        // Reset DOM URL
        if (typeof window !== 'undefined') {
            window.history.replaceState({}, '', '/');
        }

        // Clear mock history
        vi.clearAllMocks();

        // Initialize SDK with valid defaults
        // FIX: Use localhost to match happy-dom origin and prevent SecurityError
        aw = new AgeWallet({
            clientId: 'test_client_id',
            redirectUri: 'http://localhost:3000/callback',
            clientSecret: 'test_secret'
        });

        // Access internal mocks
        mockStorage = aw.storage;
        mockNetwork = aw.network;
    });

    describe('Configuration', () => {
        it('should throw an error if clientId is missing', () => {
            expect(() => new AgeWallet({})).toThrow('[AgeWallet] Missing clientId');
        });

        it('should use default endpoints if not provided', () => {
            expect(aw.config.endpoints.auth).toBe('https://app.agewallet.io/user/authorize');
        });

        it('should default to "overlay" mode', () => {
            expect(aw.config.mode).toBe('overlay');
        });
    });

    describe('Authentication Flow (generateAuthUrl)', () => {
        it('should generate correct OIDC parameters and save state', async () => {
            const authData = await aw.generateAuthUrl();
            const url = new URL(authData.url);
            const params = url.searchParams;

            // Verify URL Construction
            expect(url.origin).toBe('https://app.agewallet.io');
            expect(url.pathname).toBe('/user/authorize');
            expect(params.get('client_id')).toBe('test_client_id');
            expect(params.get('code_challenge')).toBe('mock_challenge');
            expect(params.get('code_challenge_method')).toBe('S256');
            expect(params.get('scope')).toBe('openid age');

            // Verify State Persistence
            expect(mockStorage.setOidcState).toHaveBeenCalledWith(
                'mock_random_string', // state
                'mock_verifier',      // verifier
                'mock_random_string', // nonce
                'http://localhost:3000/callback' // redirectUri (Updated)
            );
        });
    });

    describe('Token Exchange (handleCallback)', () => {
        const validCode = 'auth_code_123';
        const validState = 'state_123';

        it('should exchange code for token and save verification on success', async () => {
            // Setup Mocks
            mockStorage.getOidcState.mockResolvedValue({
                state: validState,
                verifier: 'mock_verifier',
                returnUrl: 'https://mysite.com/return'
            });

            mockNetwork.postForm.mockResolvedValue({ access_token: 'fake_jwt' });
            mockNetwork.get.mockResolvedValue({ age_verified: true }); // Verified User

            // Execute
            await aw.handleCallback(validCode, validState);

            // Assert Network Calls
            expect(mockNetwork.postForm).toHaveBeenCalledWith(
                aw.config.endpoints.token,
                expect.objectContaining({
                    grant_type: 'authorization_code',
                    code: validCode,
                    code_verifier: 'mock_verifier'
                })
            );

            expect(mockNetwork.get).toHaveBeenCalledWith(
                aw.config.endpoints.userinfo,
                'fake_jwt'
            );

            // Assert Storage
            expect(mockStorage.setVerification).toHaveBeenCalledWith({ access_token: 'fake_jwt' });
        });

        it('should abort if state is invalid (CSRF protection)', async () => {
            mockStorage.getOidcState.mockResolvedValue({ state: 'different_state' });

            await aw.handleCallback(validCode, validState);

            expect(mockNetwork.postForm).not.toHaveBeenCalled();
            expect(mockStorage.setVerification).not.toHaveBeenCalled();
        });

        it('should NOT save verification if age_verified is false', async () => {
            mockStorage.getOidcState.mockResolvedValue({ state: validState, verifier: 'v' });
            mockNetwork.postForm.mockResolvedValue({ access_token: 'fake_jwt' });
            mockNetwork.get.mockResolvedValue({ age_verified: false }); // UNDERAGE

            // Spy on console.error to keep test output clean
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            await tryCatch(() => aw.handleCallback(validCode, validState));

            expect(mockStorage.setVerification).not.toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
    });

    describe('Regional Exemptions (handleError)', () => {
        const validState = 'state_xyz';

        it('should create synthetic token for "Region does not require verification"', async () => {
            mockStorage.getOidcState.mockResolvedValue({ state: validState });

            const result = await aw.handleError(
                'access_denied',
                'Region does not require verification',
                validState
            );

            expect(result).toBe(true);
            expect(mockStorage.setVerification).toHaveBeenCalledWith(expect.objectContaining({
                access_token: 'region_exempt_placeholder',
                is_synthetic: true
            }));
        });

        it('should treat other errors as failures', async () => {
            mockStorage.getOidcState.mockResolvedValue({ state: validState });

            const result = await aw.handleError('access_denied', 'User denied', validState);

            expect(result).toBe(false);
            expect(mockStorage.setVerification).not.toHaveBeenCalled();
        });
    });

    describe('Initialization Routing (init)', () => {
        it('should route ?code=... to handleCallback', async () => {
            // Simulate URL
            window.history.replaceState({}, '', '/?code=123&state=abc');

            // Spy on handler
            const callbackSpy = vi.spyOn(aw, 'handleCallback').mockResolvedValue();

            await aw.init();

            expect(callbackSpy).toHaveBeenCalledWith('123', 'abc');
            expect(mockOverlayExecute).toHaveBeenCalled(); // Strategy should run after
        });

        it('should route ?error=... to handleError', async () => {
            // Simulate Exemption URL
            window.history.replaceState({}, '', '/?error=access_denied&error_description=Region...&state=abc');

            const errorSpy = vi.spyOn(aw, 'handleError').mockResolvedValue(true);

            await aw.init();

            expect(errorSpy).toHaveBeenCalledWith('access_denied', 'Region...', 'abc');
            expect(mockOverlayExecute).toHaveBeenCalled();
        });

        it('should execute the configured Strategy', async () => {
            // Test Overlay Mode (Default)
            await aw.init();
            expect(mockOverlayExecute).toHaveBeenCalled();
            expect(mockApiExecute).not.toHaveBeenCalled();

            // Test API Mode
            vi.clearAllMocks();
            const apiAw = new AgeWallet({ clientId: 'id', mode: 'api' });
            await apiAw.init();
            expect(mockApiExecute).toHaveBeenCalled();
        });
    });
});

// Helper to swallow async errors during tests
async function tryCatch(fn) {
    try { await fn(); } catch (e) {}
}