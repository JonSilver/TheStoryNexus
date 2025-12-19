import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GuideProvider, mdxComponents } from "../components/mdx";
import AdvancedGuide from "../content/advanced.mdx";
import BasicsGuide from "../content/basics.mdx";
import BrainstormGuide from "../content/brainstorm.mdx";
import LorebookGuide from "../content/lorebook.mdx";
import PromptGuide from "../content/prompts.mdx";

export default function GuidePage() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState("basics");

    return (
        <div className="container mx-auto py-8 max-w-5xl">
            <div className="flex items-center mb-8">
                <Button variant="ghost" className="gap-2" onClick={() => navigate(-1)}>
                    <ArrowLeft className="h-4 w-4" />
                    Back
                </Button>
                <h1 className="text-3xl font-bold ml-4">The Story Nexus Guide</h1>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Welcome to The Story Nexus</CardTitle>
                    <CardDescription>
                        Your comprehensive guide to using this AI-powered story writing application
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="basics" value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <TabsList className="grid grid-cols-5 mb-8">
                            <TabsTrigger value="basics">Basics Guide</TabsTrigger>
                            <TabsTrigger value="advanced">Advanced Guide</TabsTrigger>
                            <TabsTrigger value="lorebook">Lorebook Guide</TabsTrigger>
                            <TabsTrigger value="prompts">Prompt Guide</TabsTrigger>
                            <TabsTrigger value="brainstorm">Brainstorm Guide</TabsTrigger>
                        </TabsList>

                        <TabsContent value="basics" className="space-y-4">
                            <GuideProvider>
                                <BasicsGuide components={mdxComponents} />
                            </GuideProvider>
                        </TabsContent>

                        <TabsContent value="advanced" className="space-y-4">
                            <GuideProvider>
                                <AdvancedGuide components={mdxComponents} />
                            </GuideProvider>
                        </TabsContent>

                        <TabsContent value="lorebook" className="space-y-4">
                            <GuideProvider>
                                <LorebookGuide components={mdxComponents} />
                            </GuideProvider>
                        </TabsContent>

                        <TabsContent value="prompts" className="space-y-4">
                            <GuideProvider>
                                <PromptGuide components={mdxComponents} />
                            </GuideProvider>
                        </TabsContent>

                        <TabsContent value="brainstorm" className="space-y-4">
                            <GuideProvider>
                                <BrainstormGuide components={mdxComponents} />
                            </GuideProvider>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
}
