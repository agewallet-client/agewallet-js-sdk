import AgeWallet from './AgeWallet.js';

// Export for module bundlers (import AgeWallet from '@agewallet/sdk')
export default AgeWallet;

// Export for browser script tags (window.AgeWallet)
if (typeof window !== 'undefined') {
    window.AgeWallet = AgeWallet;
}