/** Better Auth adapters store dates as ISO text; existing fixtures also use epoch milliseconds. */
export const epochSql = (column: 'session.expiresAt' | 'invitation.expiresAt' | 'expiresAt') =>
  `(CASE WHEN typeof(${column}) IN ('integer', 'real') THEN ${column} ELSE unixepoch(${column}, 'subsec') * 1000 END)`;
