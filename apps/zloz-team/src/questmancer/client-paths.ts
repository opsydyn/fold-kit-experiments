// Read the server-rendered configuration before FoldKit takes ownership of the mount.
const authoringUrl = document.getElementById('questmancer')?.dataset.api ?? '';

export const clientPaths = () => ({ baseArt: '/questmancer-art/', authoringUrl });
