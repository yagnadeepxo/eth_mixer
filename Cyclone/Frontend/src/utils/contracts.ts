import { ethers } from "ethers";
import tornadoJSON from "../json/Tornado.json";

export const tornadoAddress = "0x552568427Beeb742f62175F0c337C48C6134b9a0"
export const tornadoInterface = new ethers.utils.Interface(tornadoJSON);