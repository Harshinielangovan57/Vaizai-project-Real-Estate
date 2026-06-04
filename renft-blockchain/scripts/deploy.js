// scripts/deploy.js
//
// Deploys all five contracts to the local Hardhat network in dependency order:
//   1. PropertyNFT
//   2. Marketplace   (depends on PropertyNFT address)
//   3. Escrow        (standalone)
//   4. Auction       (depends on PropertyNFT address)
//   5. AgreementSigner (standalone)
//
// On completion, writes /deployments/localhost.json containing every contract's
// address and ABI.  The backend loads this file on startup; the frontend fetches
// it via GET /api/config/contracts.
//
// Usage:
//   npx hardhat run scripts/deploy.js --network localhost

const { ethers, artifacts } = require("hardhat");
const fs   = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("─────────────────────────────────────────────");
  console.log("Deploying Real Estate NFT contracts");
  console.log("Deployer :", deployer.address);
  console.log("Balance  :", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");
  console.log("─────────────────────────────────────────────");

  // ── 1. PropertyNFT ────────────────────────────────────────────────────────
  console.log("\n[1/5] Deploying PropertyNFT...");
  const PropertyNFT = await ethers.getContractFactory("PropertyNFT");
  const propertyNFT = await PropertyNFT.deploy();
  await propertyNFT.waitForDeployment();
  const propertyNFTAddress = await propertyNFT.getAddress();
  console.log("      PropertyNFT deployed to:", propertyNFTAddress);

  // ── 2. Marketplace ────────────────────────────────────────────────────────
  console.log("\n[2/5] Deploying Marketplace...");
  const Marketplace = await ethers.getContractFactory("Marketplace");
  const marketplace = await Marketplace.deploy(propertyNFTAddress);
  await marketplace.waitForDeployment();
  const marketplaceAddress = await marketplace.getAddress();
  console.log("      Marketplace deployed to:", marketplaceAddress);

  // ── 3. Escrow ─────────────────────────────────────────────────────────────
  console.log("\n[3/5] Deploying Escrow...");
  const Escrow = await ethers.getContractFactory("Escrow");
  const escrow = await Escrow.deploy();
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();
  console.log("      Escrow deployed to:", escrowAddress);

  // ── 4. Auction ────────────────────────────────────────────────────────────
  console.log("\n[4/5] Deploying Auction...");
  const Auction = await ethers.getContractFactory("Auction");
  const auction = await Auction.deploy(propertyNFTAddress);
  await auction.waitForDeployment();
  const auctionAddress = await auction.getAddress();
  console.log("      Auction deployed to:", auctionAddress);

  // ── 5. AgreementSigner ────────────────────────────────────────────────────
  console.log("\n[5/5] Deploying AgreementSigner...");
  const AgreementSigner = await ethers.getContractFactory("AgreementSigner");
  const agreementSigner = await AgreementSigner.deploy();
  await agreementSigner.waitForDeployment();
  const agreementSignerAddress = await agreementSigner.getAddress();
  console.log("      AgreementSigner deployed to:", agreementSignerAddress);

  // ── Write deployments/localhost.json ──────────────────────────────────────
  const deploymentData = {
    network:    "localhost",
    chainId:    31337,
    deployedAt: new Date().toISOString(),
    deployer:   deployer.address,

    PropertyNFT: {
      address: propertyNFTAddress,
      abi:     (await artifacts.readArtifact("PropertyNFT")).abi,
    },
    Marketplace: {
      address: marketplaceAddress,
      abi:     (await artifacts.readArtifact("Marketplace")).abi,
    },
    Escrow: {
      address: escrowAddress,
      abi:     (await artifacts.readArtifact("Escrow")).abi,
    },
    Auction: {
      address: auctionAddress,
      abi:     (await artifacts.readArtifact("Auction")).abi,
    },
    AgreementSigner: {
      address: agreementSignerAddress,
      abi:     (await artifacts.readArtifact("AgreementSigner")).abi,
    },
  };

  const outDir  = path.join(__dirname, "..", "deployments");
  const outFile = path.join(outDir, "localhost.json");

  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(deploymentData, null, 2));

  console.log("\n─────────────────────────────────────────────");
  console.log("All contracts deployed successfully.");
  console.log("Deployment manifest written to:");
  console.log(" ", outFile);
  console.log("─────────────────────────────────────────────");
  console.log("\nContract addresses summary:");
  console.log("  PropertyNFT    :", propertyNFTAddress);
  console.log("  Marketplace    :", marketplaceAddress);
  console.log("  Escrow         :", escrowAddress);
  console.log("  Auction        :", auctionAddress);
  console.log("  AgreementSigner:", agreementSignerAddress);
  console.log("\nNext steps:");
  console.log("  • Start the backend:  cd ../backend && npm run dev");
  console.log("  • Start the frontend: cd ../frontend && npm run dev");
  console.log("  • Open MetaMask → Add Network → localhost:8545 (chainId 31337)");
  console.log("  • Import Hardhat test account #0 private key into MetaMask");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});