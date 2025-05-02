import { CloudLightning } from "lucide-react";
import React from "react";
interface Props {
	params: {
		test: string;
	};
}
const Page = ({ params }: Props) => {
	const dms = params.test.valueOf() === "dms";
	const activity = params.test.valueOf() === "activity";
	const more = params.test.valueOf() === "more";

	if (dms) return <div>DMs</div>;
	if (activity) return <div>Activity</div>;
	if (more) return <div>More</div>;
	return <div>Page {params.test}</div>;
};

export default Page;
