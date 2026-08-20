/**
 * Jest setup for the app workspace.
 *
 * AsyncStorage is native storage — in jest it is the library's own in-memory
 * mock, the integration @react-native-async-storage/async-storage documents.
 * The mock keeps a real Map, so the storage adapter's round-trip tests
 * exercise genuine set/get/remove semantics without a device.
 */
import { jest } from '@jest/globals';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
