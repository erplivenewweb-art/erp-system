import type { Metadata } from "next"; import { DealerPricing } from "@/features/dealer";
export const metadata:Metadata={title:"Dealer pricing and terms preview",description:"Static pricing, MOQ and credit explanation.",robots:{index:false,follow:false}}; export default function Page(){return <DealerPricing/>;}
