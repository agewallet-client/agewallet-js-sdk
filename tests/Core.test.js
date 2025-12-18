// tests/Core.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AgeWallet } from '../src/AgeWallet.js';

// --- Mocks ---
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
    // Helper to restore window.location after we mess with it
    const originalLocation = window.location;

    beforeEach(() => {
        // Restore window.location to a standard state for most tests
        // Note: In JSDOM/Vitest, simply assigning window.location = ... might not work perfectly
        // without delete first, but we handle that in specific tests.
        // For general tests, we assume a clean state.

        vi.clearAllMocks();

        // Setup default AW instance
        aw = new AgeWallet({
            clientId: 'test_client_id',
            redirectUri: 'http://localhost:3000/callback',
            clientSecret: 'test_secret'
        });

        mockStorage = aw.storage;
        mockNetwork = aw.network;
    });

    afterEach(() => {
        // Restore the original location object if a test replaced it
        if (window.location !== originalLocation) {
            window.location = originalLocation;
        }
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
        it('should capture current URL (Deep Link) as returnUrl', async () => {
            // Mock window.location.href for this specific test
            // We use Object.defineProperty to override href getter if needed,
            // but since we want to test the behavior, let's just assume the test runner
            // is at a specific URL or use the fallback logic.
            // A safer way in JSDOM is to use pushState.
            window.history.pushState({}, 'Test', '/product/123');

            const authData = await aw.generateAuthUrl();
            const url = new URL(authData.url);
            const params = url.searchParams;

            // 1. Verify OIDC Redirect URI is STRICT (Homepage/Callback)
            expect(params.get('redirect_uri')).toBe('http://localhost:3000/callback');

            // 2. Verify State Persistence captured the Deep Link
            expect(mockStorage.setOidcState).toHaveBeenCalledWith(
                'mock_random_string',
                'mock_verifier',
                'mock_random_string',
                'http://localhost:3000/product/123' // The deep link
            );
        });
    });

    describe('Token Exchange (handleCallback)', () => {
        const validCode = 'auth_code_123';
        const validState = 'state_123';
        const deepLink = 'http://localhost:3000/deep-link-destination';

        it('should return Deep Link and save verification on success', async () => {
            mockStorage.getOidcState.mockResolvedValue({
                state: validState,
                verifier: 'mock_verifier',
                returnUrl: deepLink
            });

            mockNetwork.postForm.mockResolvedValue({ access_token: 'fake_jwt' });
            mockNetwork.get.mockResolvedValue({ age_verified: true });

            const result = await aw.handleCallback(validCode, validState);

            expect(mockNetwork.postForm).toHaveBeenCalledWith(
                aw.config.endpoints.token,
                expect.objectContaining({
                    redirect_uri: 'http://localhost:3000/callback' // STRICT
                })
            );

            expect(result).toBe(deepLink);
            expect(mockStorage.setVerification).toHaveBeenCalledWith({ access_token: 'fake_jwt' });
        });

        it('should return null if state is invalid', async () => {
            mockStorage.getOidcState.mockResolvedValue({ state: 'different_state' });
            const result = await aw.handleCallback(validCode, validState);
            expect(result).toBeNull();
        });

        // RESTORED TEST CASE
        it('should NOT save verification if age_verified is false', async () => {
            mockStorage.getOidcState.mockResolvedValue({ state: validState, verifier: 'v' });
            mockNetwork.postForm.mockResolvedValue({ access_token: 'fake_jwt' });
            mockNetwork.get.mockResolvedValue({ age_verified: false }); // UNDERAGE

            // Spy on console.error to keep test output clean
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            await aw.handleCallback(validCode, validState);

            expect(mockStorage.setVerification).not.toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
    });

    describe('Regional Exemptions (handleError)', () => {
        const validState = 'state_xyz';
        const deepLink = 'http://localhost:3000/exempt-page';

        it('should return Deep Link for "Region does not require verification"', async () => {
            mockStorage.getOidcState.mockResolvedValue({
                state: validState,
                returnUrl: deepLink
            });

            const result = await aw.handleError(
                'access_denied',
                'Region does not require verification',
                validState
            );

            expect(result).toBe(deepLink);
            expect(mockStorage.setVerification).toHaveBeenCalledWith(expect.objectContaining({
                is_synthetic: true
            }));
        });

        it('should return false for other errors', async () => {
            mockStorage.getOidcState.mockResolvedValue({ state: validState });
            const result = await aw.handleError('access_denied', 'User denied', validState);
            expect(result).toBe(false);
        });
    });

    describe('Initialization Routing (init)', () => {
        it('should redirect browser if handleCallback returns a deep link', async () => {
            // FIX: We must completely replace window.location to mock 'search' and 'href' properties
            delete window.location;
            window.location = {
                // 'search' is critical for the SDK to detect it's in a callback
                search: '?code=123&state=abc',
                href: 'http://localhost:3000/callback?code=123&state=abc',
                assign: vi.fn(),
                replace: vi.fn()
            };

            const deepLink = 'http://localhost:3000/final-dest';

            // Mock handleCallback to return the deep link
            vi.spyOn(aw, 'handleCallback').mockResolvedValue(deepLink);

            await aw.init();

            // Assert Redirect happened (href updated)
            expect(window.location.href).toBe(deepLink);

            // Assert Strategy NOT executed (because we redirected)
            expect(mockOverlayExecute).not.toHaveBeenCalled();
        });

        it('should stay on page if handleCallback returns null or current URL', async () => {
            // Setup location
            const currentUrl = 'http://localhost:3000/';
            delete window.location;
            window.location = {
                search: '?code=123&state=abc',
                href: currentUrl
            };

            // Returns current URL (no redirect needed)
            vi.spyOn(aw, 'handleCallback').mockResolvedValue(currentUrl);

            await aw.init();

            // Strategy SHOULD execute
            expect(mockOverlayExecute).toHaveBeenCalled();
        });
    });
});