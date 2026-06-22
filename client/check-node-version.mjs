const [major] = process.versions.node.split(".").map(Number);

if (major !== 24) {
  console.error(
    `This project must run on Node.js 24.x LTS. Current version: ${process.version}.`,
  );
  process.exit(1);
}
