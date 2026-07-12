import type { Metadata } from "next"; import { DealerKyc } from "@/features/dealer";
export const metadata:Metadata={title:"Dealer verification preview",description:"Static KYC upload placeholders.",robots:{index:false,follow:false}}; export default function Page(){return <DealerKyc/>;}
