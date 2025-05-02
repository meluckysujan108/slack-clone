"use client";
import { useWorkspaceId } from "@/hooks/use-workspace-id";

const ThreadsPage = () => {
	const workspaceId = useWorkspaceId();

	return <div>WorkspaceId: {workspaceId}</div>;
};

export default ThreadsPage;
