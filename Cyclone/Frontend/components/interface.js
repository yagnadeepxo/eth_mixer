import { useState } from "react";
import {ethers} from "ethers";
import utils from "../utils/utils.js";
const wc = require('../circuit/witness_calculator.js')


const tornadoJSON = require("../json/Tornado.json");
let tornadoAddress = "0x552568427Beeb742f62175F0c337C48C6134b9a0"
const tornadoInterface = new ethers.utils.Interface(tornadoJSON);

const ButtonState = { Normal: 0, Loading: 1, Disabled: 2 };

 
const Interface = ()=>{
    const [account, updateAccount] = useState(null); 
    const [proofElements, updateProofElements] = useState(null); 
    const [metamaskButtonState, updateMetamaskButtonState] = useState(0);
    const [inputValue, setInputValue] = useState(null);
    const[withdrawSuccess,updateWithdrawSuccess] = useState(false);
 
    const connectMetamask = async () => {
        try{
            if(!window.ethereum){
                alert("Please install Metamask to use this app.");
                throw "no-metamask";
            }

            var accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
            var chainId = window.ethereum.networkVersion;

            if(chainId != "5"){
                alert("Please switch to Goerli Testnet");
                throw "wrong-chain";
            }

            var activeAccount = accounts[0];
            var newAccountState = {
                chainId: chainId,
                address: activeAccount,
            };
            updateAccount(newAccountState);
        }catch(e){
            console.log(e);
        }
    };


    const depositEther = async () => {
        //updateDepositButtonState(ButtonState.Disabled);
        const secret = ethers.BigNumber.from(ethers.utils.randomBytes(32)).toString();
        const nullifier = ethers.BigNumber.from(ethers.utils.randomBytes(32)).toString();

        const input = {
            secret: utils.BN256ToBin(secret).split(""),
            nullifier: utils.BN256ToBin(nullifier).split("")
        };

        var res = await fetch("/deposit.wasm");
        var buffer = await res.arrayBuffer();
        var depositwc = await wc(buffer); 
        const r = await depositwc.calculateWitness(input, 0);

        const commitment = r[1];
        const bigNumber = ethers.BigNumber.from(commitment);
        const uint256Value = ethers.utils.hexZeroPad(bigNumber.toHexString(), 32); 
        const nullifierHash = r[2];
        const value = ethers.BigNumber.from("100000000000000").toHexString();
        const tx = {
            to: tornadoAddress,
            from: account.address,
            value: value,
            data: tornadoInterface.encodeFunctionData("deposit", [uint256Value])
        };
        try{
            
            // const alchemyApiKey = '';
            // const provider = new ethers.providers.AlchemyProvider('goerli', alchemyApiKey);
            // const privkey = ''
            // const signer = new ethers.Wallet(privkey, provider);
            // const transactionResponse = await signer.sendTransaction(tx);
            // const transactionReceipt = await transactionResponse.wait();
            // console.log(transactionReceipt)
            const txHash = await window.ethereum.request({ method: "eth_sendTransaction", params: [tx] });
            const proofElements = await {
                nullifierHash: `${nullifierHash}`,
                secret: secret,
                nullifier: nullifier,
                commitment: `${commitment}`,
                txHash: txHash
            };
            // const proofElementsString = JSON.stringify(proofElements); // Convert the object to a JSON string
            // const proofElementsBuffer = Buffer.from(proofElementsString, 'utf-8'); // Convert the string to a buffer using utf-8 encoding
            // const proofElementsBase64 = proofElementsBuffer.toString('base64'); 
            // updateProofElements(proofElementsBase64)
            const btoa = (text) => Buffer.from(text, 'binary').toString('base64');
            updateProofElements(btoa(JSON.stringify(proofElements)))

        }catch(e){
            console.log(e);
        }
    }

    const copyLink = (proofElements) => {
        navigator.clipboard.writeText(proofElements)
            .then(() => {
            console.log(`Copied to clipboard: ${proofElements}`);
            alert("copied")
            })
            .catch((err) => {
            console.error(`Failed to copy to clipboard: ${err}`);
            });
    }

    const withdraw = async () => {
        const Snarkjs = window['snarkjs']
        const atob = (base64) => Buffer.from(base64, 'base64').toString('binary');
        const input = JSON.parse(atob(inputValue))
        var receipt = await window.ethereum.request({ method: "eth_getTransactionReceipt", params: [input.txHash] });
        const log = receipt.logs[0];
        const decodedData = await tornadoInterface.decodeEventLog("Deposit", log.data, log.topics);
        try{
        const proofInput = await{
            "root": utils.BNToDecimal(decodedData.root),
            "nullifierHash": input.nullifierHash,
            "recipient": utils.BNToDecimal(account.address),
            "secret": utils.BN256ToBin(input.secret).split(""),
            "nullifier": utils.BN256ToBin(input.nullifier).split(""),
            "hashPairings": decodedData.hashPairings.map((n) => (utils.BNToDecimal(n))),
            "hashDirections": decodedData.pairDirection
        };
        const { proof, publicSignals } = await Snarkjs.groth16.fullProve(proofInput, "/withdraw.wasm", "/setup_final.zkey");
        
        const callInputs = [
            proof.pi_a.slice(0, 2).map(utils.BN256ToHex),
            proof.pi_b.slice(0, 2).map((row) => (utils.reverseCoordinate(row.map(utils.BN256ToHex)))),
            proof.pi_c.slice(0, 2).map(utils.BN256ToHex),
            publicSignals.slice(0, 2).map(utils.BN256ToHex)
        ];

        const callData = tornadoInterface.encodeFunctionData("withdraw", callInputs);
        const tx = {
            to: tornadoAddress,
            from: account.address,
            data: callData
        };
        const txHash = await window.ethereum.request({ method: "eth_sendTransaction", params: [tx] });
        var final_res;
        while(!final_res){
            final_res = await window.ethereum.request({ method: "eth_getTransactionReceipt", params: [txHash] });
            await new Promise((resolve, reject) => { setTimeout(resolve, 1000); });
        }
        if(final_res){
            updateWithdrawSuccess(true);
        }
    }catch(e){
        console.log(e)
    }
}
    return(
        <div>
            {
             account ? (
                <div>
                    <p>chainD: {account.chainId}</p>
                    <p>address: {account.address}</p>
                </div>
             ):(
                <div>
                    <button onClick={connectMetamask}>connect wallet</button>
                </div>
             )
            }
            <div><hr/></div>
            {
                account ? (
                    <div>
                        <button onClick={depositEther}>deposit 1 eth</button>
                    </div>
                ):(
                    <div>bro connect wallet</div>
                )
            }
            {
                account ? (
                    <div>
                        {
                            proofElements ? (
                                <div>
                                    {proofElements}
                                </div>
                            ):(
                                <div></div>
                            )
                        }
                    </div>
                ):(
                    <div></div>
                )
            } 
            <br></br>
            <div>withdraw</div><br></br>
            <div>
            <textarea value={inputValue} onChange={(event) => setInputValue(event.target.value)} placeholder="Enter Base64 secret" />
            </div>
            <br></br>
            <button onClick={withdraw}>withdraw</button><br></br>
            {
                withdrawSuccess ? (
                    <div>
                        <p>withdraw Success</p>
                    </div>
                ):(
                    <div>
                        <p>hold on</p>
                    </div>
                )
            }
        </div>
        
    )
}

export default Interface;