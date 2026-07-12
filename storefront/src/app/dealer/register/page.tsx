import type { Metadata } from "next"; import { DealerRegistration } from "@/features/dealer";
export const metadata:Metadata={title:"Dealer registration preview",description:"Static dealer application UI.",alternates:{canonical:"/dealer/register"},robots:{index:false,follow:false}}; export default function Page(){return <DealerRegistration/>;}
