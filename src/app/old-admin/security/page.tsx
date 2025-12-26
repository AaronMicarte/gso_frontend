'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import MFASetup from '@/components/auth/MFASetup';
import TrustedDevices from '@/components/auth/TrustedDevices';
import { Shield, Smartphone } from 'lucide-react';

export default function SecurityPage() {
    return (
        <div className="container mx-auto py-8 px-4 max-w-4xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Security Settings</h1>
                <p className="text-gray-500 mt-2">Manage your account security and authentication settings</p>
            </div>

            <Tabs defaultValue="mfa" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-8">
                    <TabsTrigger value="mfa" className="flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        Two-Factor Authentication
                    </TabsTrigger>
                    <TabsTrigger value="devices" className="flex items-center gap-2">
                        <Smartphone className="w-4 h-4" />
                        Trusted Devices
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="mfa">
                    <MFASetup />
                </TabsContent>
                <TabsContent value="devices">
                    <TrustedDevices />
                </TabsContent>
            </Tabs>
        </div>
    );
}
