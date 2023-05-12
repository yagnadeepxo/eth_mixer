import Script from "next/script";
import Interface from "../components/interface";

const Index = ()=>{
    return(
        <div>
            <Script src="/snarkjs.js" />
            <Interface />
        </div>
        
    )
}

export default Index;