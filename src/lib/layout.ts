import { matchPath } from 'react-router-dom';

/** The side menu shows everywhere except the diet plan editor, which needs the full width for its meals and side panel. */
export const showsSideMenu = (pathname: string) => !matchPath('/doctor/patient/:id/diet-plan', pathname);
