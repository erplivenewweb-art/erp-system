import type { Metadata } from "next"; import { DealerSupport } from "@/features/dealer";
export const metadata:Metadata={title:"Dealer support preview",description:"Static wholesale support and FAQ.",robots:{index:false,follow:false}}; export default function Page(){return <DealerSupport/>;}
