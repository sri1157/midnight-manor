const TITLES = /^(dr\.?|doctor|lady|lord|sir|count|countess|colonel|captain|mr\.?|mrs\.?|miss|ms\.?|madam|maid|professor)\s+/i;

/** "Count Viktor Volkov" -> "Viktor" */
export const shortName = (name) => name.replace(TITLES, '').split(' ')[0] || name;

/** "Count Viktor Volkov" -> "V" */
export const initialOf = (name) => shortName(name)[0]?.toUpperCase() ?? '?';
