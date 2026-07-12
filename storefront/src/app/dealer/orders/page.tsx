import type { Metadata } from "next"; import { DealerOrders } from "@/features/dealer";
export const metadata:Metadata={title:"Dealer orders preview",description:"Static trade order-history shell.",robots:{index:false,follow:false}}; export default function Page(){return <DealerOrders/>;}
