import type { Metadata } from "next"; import { DealerDashboard } from "@/features/dealer";
export const metadata:Metadata={title:"Dealer dashboard preview",description:"Static wholesale dashboard without dealer data.",robots:{index:false,follow:false}}; export default function Page(){return <DealerDashboard/>;}
