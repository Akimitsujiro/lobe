import { ActionIcon, Icon } from '@lobehub/ui';
import { Upload } from 'antd';
import { useTheme } from 'antd-style';
import { LucideFileUp, LucideLoader2 } from 'lucide-react';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Center } from 'react-layout-kit';

import { useFileStore } from '@/store/files';

const FileUpload = memo(() => {
  const { t } = useTranslation('chat');
  const [loading, setLoading] = useState(false);
  const theme = useTheme();
  const upload = useFileStore((s) => s.uploadFile);
  return (
    <Upload
      beforeUpload={async (file) => {
        setLoading(true);

        await upload(file);

        setLoading(false);
        return false;
      }}
      showUploadList={false}
    >
      {loading ? (
        <Center height={36} width={36}>
          <Icon
            color={theme.colorTextSecondary}
            icon={LucideLoader2}
            size={{ fontSize: 18 }}
            spin
          ></Icon>
        </Center>
      ) : (
        <ActionIcon icon={LucideFileUp} placement={'bottom'} title={t('uploadFile')} />
      )}
    </Upload>
  );
});

export default FileUpload;
