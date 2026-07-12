import type { Metadata } from "next"; import { DealerCatalogue } from "@/features/dealer";
export const metadata:Metadata={title:"Dealer catalogue preview",description:"Static wholesale catalogue without prices.",robots:{index:false,follow:false}}; export default function Page(){return <DealerCatalogue/>;}
