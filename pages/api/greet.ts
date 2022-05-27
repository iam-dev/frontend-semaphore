import Greeter from "artifacts/contracts/Greeters.sol/Greeters.json";
import { Contract, providers, utils, Wallet } from "ethers";
import type { NextApiRequest, NextApiResponse } from "next";

// This API can represent a backend.
// The contract owner is the only account that can call the `greet` function,
// However they will not be aware of the identity of the users generating the proofs.

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log("req.body", req.body);
  const { greeting, nullifierHash, solidityProof } = JSON.parse(req.body);
  const provider = new providers.JsonRpcProvider(process.env.MUMBAI_URL);

  console.log("greeting:", greeting);
  // const contract = new Contract("0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512", Greeter.abi)
  // const provider = new providers.JsonRpcProvider("http://localhost:8545")

  // const contractOwner = contract.connect(provider.getSigner())

  const wallet = new Wallet(process.env.PRIVATE_KEY, provider);
  console.log("wallet", wallet.address);

  const contract = new Contract(
    "0xcBdcB15F89719621f3FF5E9584031b95516F4935",
    Greeter.abi,
    wallet
  );
  // console.log("contract", contract);
  const trx = await contract.greeters();
  console.log("trx", trx);
  const solidityGreeting = utils.solidityKeccak256(["string"], [greeting]);
  console.log("solidityGreeting:", solidityGreeting);
  console.log("nullifierHash:", nullifierHash);
  console.log("solidityProof:", solidityProof);

  try {
    await contract.greet(
      utils.solidityKeccak256(["string"], [greeting]),
      nullifierHash,
      solidityProof
    );

    res.status(200).end();
  } catch (error: any) {
    const { message } = JSON.parse(error.body).error;
    const reason = message.substring(
      message.indexOf("'") + 1,
      message.lastIndexOf("'")
    );

    res.status(500).send(reason || "Unknown error!");
  }
}
