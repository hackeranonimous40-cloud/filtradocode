/**
 * HTTP utility constants and helpers
 */
import { MACRO } from '../constants/macros.js'

// WARNING: We rely on `OpenCarbo` in the user agent for log filtering.
// Please do NOT change this without making sure that logging also gets updated!
export const USER_AGENT = `OpenCarbo/${MACRO.VERSION} (${process.env.USER_TYPE})`
