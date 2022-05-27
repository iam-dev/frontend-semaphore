import detectEthereumProvider from "@metamask/detect-provider"
import { Strategy, ZkIdentity } from "@zk-kit/identity"
import { Semaphore } from "@zk-kit/protocols"
import { IncrementalMerkleTree } from "@zk-kit/incremental-merkle-tree"
import { poseidon } from "circomlibjs"
import { providers } from "ethers"
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as Yup from 'yup';
import Head from "next/head"
import React from "react"
import styles from "../styles/Home.module.css"

export default function Home() {
    const [logs, setLogs] = React.useState("Connect your wallet and greet!")
    // form validation rules 
    const validationSchema = Yup.object().shape({
        name: Yup.string()
            .required('Name is required'),
        age: Yup.number()
            .required('Age is required')
            .positive('Age must be a positive number'),
        address: Yup.string()
            .required('Address is required'),      
    });

    const formOptions = { resolver: yupResolver(validationSchema)};
    // get functions to build form with useForm() hook
    const { register, handleSubmit, reset, formState } = useForm(formOptions)
    const { errors } = formState;

    const onSubmitHandler = (userInput: any) => {
        console.log(userInput)
        greet(userInput)
        //reset()
    }

    async function greet() {
        setLogs("Creating your Semaphore identity...")

        const provider = (await detectEthereumProvider()) as any

        await provider.request({ method: "eth_requestAccounts" })

        const ethersProvider = new providers.Web3Provider(provider)
        const signer = ethersProvider.getSigner()
        const message = await signer.signMessage("Sign this message to create your identity!")

        const identity = new ZkIdentity(Strategy.MESSAGE, message)
        const identityCommitment = identity.genIdentityCommitment()
        // const identityCommitments = await (await fetch("./identityCommitments.json")).json()

        // const merkleProof = generateMerkleProof(20, BigInt(0), identityCommitments, identityCommitment)
        const tree = new IncrementalMerkleTree(poseidon, 20, BigInt(0), 2)
        console.log("tree", tree)
        tree.insert(identityCommitment)
        const leafIndex = tree.leaves.indexOf(BigInt(identityCommitment))
        console.log("leafIndex", leafIndex)

        if (leafIndex === -1) {
            throw new Error("Semaphore identity is not yet verifiable onchain")
        }

        const merkleProof = tree.createProof(leafIndex)

        setLogs("Creating your Semaphore proof...")

        const greeting = "Hello world"

        const witness = Semaphore.genWitness(
            identity.getTrapdoor(),
            identity.getNullifier(),
            merkleProof,
            merkleProof.root,
            greeting
        )

        const { proof, publicSignals } = await Semaphore.genProof(witness, "./semaphore.wasm", "./semaphore_final.zkey")
        const solidityProof = Semaphore.packToSolidityProof(proof)

        const response = await fetch("/api/greet", {
            method: "POST",
            body: JSON.stringify({
                greeting,
                nullifierHash: publicSignals.nullifierHash,
                solidityProof: solidityProof
            })
        })

        if (response.status === 500) {
            const errorMessage = await response.text()

            setLogs(errorMessage)
        } else {
            setLogs("Your anonymous greeting is onchain :)")
        }
    }

    return (
        <div className={styles.container}>
            <Head>
                <title>Greetings</title>
                <meta name="description" content="A simple Next.js/Hardhat privacy application with Semaphore." />
                <link rel="icon" href="/favicon.ico" />
            </Head>

            <main className={styles.main}>
                <h1 className={styles.title}>Greetings</h1>

                <p className={styles.description}>A simple Next.js/Hardhat privacy application with Semaphore.</p>

                <div className={styles.logs}>{logs}</div>
                <form onSubmit={handleSubmit(onSubmitHandler)}>
                    <div className="form-group">
                        <input  type="text"
                                placeholder="Name"
                                id="inputName"
                                {...register("name")} 
                                className={`form-control ${errors.name ? 'is-invalid' : ''}`}
                                required
                        />
                        <div className={styles.invalid}>{errors.name?.message}</div>
                    </div>
                    <input  type="number"
                            placeholder="Age"
                            id="inputAge"
                            {...register("age")}
                            className={`form-control ${errors.age ? 'is-invalid' : ''}`}
                            required
                    />
                    <div className={styles.invalid}>{errors.age?.message}</div>
                    <input  type="text"
                                placeholder="Address"
                                id="inputAddress"
                                {...register("address")} 
                                className={`form-control ${errors.address ? 'is-invalid' : ''}`}
                                required
                    />
                    <div className={styles.invalid}>{errors.address?.message}</div>
                    <div className="form-group">
                        <button className={styles.button} type="submit" >Sign Identity</button>
                        <button className={styles.button} type="button" onClick={() => reset()} >Reset Form</button>
                    </div>
                </form>
            </main>
        </div>
    )
}
