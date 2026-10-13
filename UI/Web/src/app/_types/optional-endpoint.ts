import {HttpContextToken} from '@angular/common/http';

/** Older servers may not expose this optional feature. Other errors still surface normally. */
export const OPTIONAL_ENDPOINT = new HttpContextToken<boolean>(() => false);
